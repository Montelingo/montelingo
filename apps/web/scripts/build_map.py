"""Splits the Figma map export into the art the map shows and its geometry.

Usage (from apps/web):

    uv run --no-project --with shapely python scripts/build_map.py \
        path/to/montenegro-map.svg

The export follows the designers' map contract: every layer has a
lowercase-hyphen id and no transforms, so every coordinate is absolute in the
1600x1000 viewBox. The script writes:

- public/maps/base.svg: background, regions and scenery: the whole map.
- public/maps/fog-<region>.svg: one region's fog, shown while it is locked.
- public/maps/decorations-<region>.svg and places-<region>.svg: a region's
  decorations and its places' buildings, shown when the map zooms to it.
- src/features/map/model/map-geometry.ts: where the app draws what changes
  with state or language: each place's dot (whole map) and its marker, name
  and hit area (zoomed in, sized for that zoom), each region's outline, name
  and zoomed view, the title and the neighbours' names.

Everything the app draws itself is left out of the art: markers, label
pills, region chips, completed flags, hit areas, the guide eagle, the rewards
and every outlined text, which is English in the export.
"""

from __future__ import annotations

import colorsys
import copy
import json
import random
import re
import sys
import xml.etree.ElementTree as ET
from math import cos, pi, sin
from pathlib import Path

from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.ops import nearest_points, unary_union

SVG_NS = "http://www.w3.org/2000/svg"
NS = f"{{{SVG_NS}}}"
ET.register_namespace("", SVG_NS)

WEB_ROOT = Path(__file__).resolve().parent.parent
MAPS_DIR = WEB_ROOT / "public" / "maps"
GEOMETRY_PATH = WEB_ROOT / "src" / "features" / "map" / "model" / "map-geometry.ts"

VIEW_BOX = (0, 0, 1600, 1000)

# Outlined English text in the background and title; the app draws its own.
REMOVED_IDS = {
    "neighbour-labels",
    "sea-label",
    "map-title-text",
    "map-title-text-2",
    "compass-text",
    "rewards",
    "guide-eagle",
    # The top bar sits where the map's title box was.
    "map-title",
    # Fewer buildings on the map, for a start, and none that is not a place.
    "decoration-coast-perast",
    "decoration-coast-sveti-stefan",
    "decoration-central-ostrog",
    "decoration-central-millennium-bridge",
}

# Places drawn without their art: only their marker and name, where the place
# is. Tivat's art, a palm island in a pool, has no place in the bay.
HIDDEN_ART = {"tivat"}

# The coastal towns sit on the coastline, at the point of it nearest to where
# each really is: its latitude and longitude, through a least-squares fit of
# the map to the real positions of the inland towns. Each one's building moves
# with it, centred on the shore.
#
# The map's coast is drawn freely, so the fit puts the towns around the Bay of
# Kotor and Ulcinj a little off: theirs are set by hand along the coast, where
# they are on the map's bay. Herceg Novi at its mouth; Tivat on the south
# shore of the channel into it; Kotor in the south-east corner of the inner
# bay (its north tip stands for Risan and Perast); Ulcinj 70% of the way from
# Bar to the Bojana, at the border.
COASTAL_TOWNS = {
    "herceg-novi": (530, 618),
    "kotor": (606, 676),
    "tivat": (572, 664),
    "budva": (654, 710),
    "bar": (762, 816),
    "ulcinj": (835, 925),
}

# Places whose marker and name trade places with their art once laid out: the
# marker goes where the place is, its building beside it. Every coastal town:
# its marker on the shore, its building just inland.
SWAPPED = set(COASTAL_TOWNS) - HIDDEN_ART

# The regions' fill and their white border, redrawn from each region's merged
# outline: the export draws a region in pieces, each with its own border, so
# an old boundary between two pieces showed as a second border.
REGION_BORDER_WIDTH = 2.6

# Decorations that are buildings, drawn smaller when zoomed in like the
# places' buildings. The rest (boats, fish, mountains, forest) keep their size.
BUILDING_DECORATIONS = {
    "decoration-central-ostrog",
    "decoration-central-millennium-bridge",
    "decoration-north-tara-bridge",
}


def main(export_path: Path) -> None:
    root = ET.parse(export_path).getroot()
    tree_map = find(root, "montenegro-map")
    by_id = {el.get("id"): el for el in tree_map.iter() if el.get("id")}

    regions = [
        el.get("id").removeprefix("region-")
        for el in tree_map
        if re.fullmatch(r"region-[a-z-]+", el.get("id") or "")
    ]

    geometry = {
        "viewBox": list(VIEW_BOX),
        "compassLetter": bbox_of(by_id["compass-text"]),
        "sea": bbox_of(by_id["sea-label"]),
        "neighbours": {
            el.get("id").removeprefix("neighbor-label-").removeprefix("neighbour-label-"): bbox_of(
                el
            )
            for el in by_id["neighbour-labels"]
        },
        "regions": {},
        "locations": {},
    }

    land = path_points(by_id["country-outline"].get("d", ""))
    # Only Montenegro's part of the lake: the export draws all of it, half in
    # Albania, outside the region's fog.
    lake = polygon_of(by_id["skadar-lake-water"]).intersection(polygon_of(by_id["country-outline"]))
    by_id["skadar-lake-water"].set("d", path_data(lake))
    shapes = {region: merged(by_id[f"region-{region}-shape"]) for region in regions}
    for region, shape in shapes.items():
        # The lake is the central region's: no other region reaches under it.
        if by_id[f"region-{region}"].find(".//*[@id='skadar-lake-water']") is None:
            shapes[region] = shape.difference(lake)
    move_strips(shapes)
    country = polygon_of(by_id["country-outline"])
    shapes = naturalise(shapes, keep=[country.exterior, lake.boundary])
    for region, shape in shapes.items():
        redraw_region(by_id[f"region-{region}-shape"], shape)
    # Drawn over every region, so no region's fill covers it.
    lake_element = by_id["skadar-lake-water"]
    parent_of(tree_map, lake_element).remove(lake_element)
    tree_map.insert(list(tree_map).index(by_id[f"region-{regions[-1]}"]) + 1, lake_element)
    neighbours = unary_union(
        [
            polygon
            for group in ("neighbours", "neighbours-extend-west", "neighbours-extend-east")
            if group in by_id
            for polygon in polygons_of(by_id[group])
        ]
    )
    names = place_names()
    region_names = place_names("regions")
    for region in regions:
        group = by_id[f"region-{region}"]
        shape = shapes[region]
        outline = list(largest(shape).exterior.coords)
        # Where its land meets the sea: its edge, less where it meets another
        # region, a neighbouring country or the lake.
        others = unary_union([other for name, other in shapes.items() if name != region])
        coastline = (
            shape.boundary.difference(others.buffer(3))
            .difference(neighbours.buffer(3))
            .difference(lake.buffer(3))
        )
        # The fog's veil follows the region's border as drawn here; its
        # clouds stay where the export puts them.
        veil = by_id.get(f"fog-veil-{region}")
        if veil is not None:
            veil.set("d", path_data(shape))
        write_svg(MAPS_DIR / f"fog-{region}.svg", wrap(by_id[f"overlay-fog-{region}"]))

        places = new_svg()
        arts: dict[str, dict[str, float]] = {}
        dots: dict[str, tuple[float, float]] = {}
        shifts: dict[str, tuple[float, float]] = {}
        radius = 24.0
        for location_group in [el for el in group if (el.get("id") or "").startswith("location-")]:
            location = location_group.get("id").removeprefix("location-")
            disc = rect_of(child_rect(by_id[f"marker-{location}"]))
            radius = round(disc["width"] / 2, 2)
            # The marker sits beside its place's art, so the leader lines that
            # joined art and marker in the export are not drawn.
            visual = copy.deepcopy(by_id[f"location-{location}-visual"])
            removed = {f"label-{location}", f"leader-line-{location}", *REMOVED_IDS}
            if location in HIDDEN_ART:
                art = bbox_of(by_id[f"illustration-{location}"])
                removed.add(f"illustration-{location}")
            remove_ids(visual, removed)
            places.append(visual)
            if location not in HIDDEN_ART:
                art = bbox_of(find(visual, f"illustration-{location}"))
            centre = (art["x"] + art["width"] / 2, art["y"] + art["height"] / 2)
            if location in COASTAL_TOWNS and not coastline.is_empty:
                shore = nearest_points(coastline, Point(COASTAL_TOWNS[location]))[0]
                dot = (shore.x, shore.y)
            else:
                dot = on_land(centre, land)
            # A place moved to the shore takes its building with it.
            shifts[location] = (dot[0] - centre[0], dot[1] - centre[1])
            if location in COASTAL_TOWNS:
                art = moved(art, shifts[location])
            dots[location] = dot
            if location in HIDDEN_ART:
                # Nothing is drawn: the place's marker goes where its dot is.
                art = {"x": dot[0], "y": dot[1], "width": 0, "height": 0}
            arts[location] = art
        left, top, right, bottom = shape.bounds
        shape_box = {"x": left, "y": top, "width": right - left, "height": bottom - top}
        view = zoom_view(union([shape_box, *arts.values()]))
        scale = min(1.0, view["width"] / VIEW_BOX[2] * ZOOMED_SIZE)

        # Zoomed in, the buildings would be drawn as much larger as the zoom;
        # each shrinks around its own centre by the same scale as the markers
        # and names, so it looks about the size it has on the whole map.
        for location in arts:
            if location not in HIDDEN_ART:
                shift = shifts[location] if location in COASTAL_TOWNS else (0, 0)
                shifts[location] = shift
                arts[location] = shrink(find(places, f"illustration-{location}"), scale, shift)
        decorations = wrap(by_id[f"decorations-{region}"])
        remove_ids(decorations, REMOVED_IDS)
        for decoration in decorations.iter():
            if decoration.get("id") in BUILDING_DECORATIONS:
                shrink(decoration, scale)
        write_svg(MAPS_DIR / f"decorations-{region}.svg", decorations)
        geometry["regions"][region] = {
            "outline": path_data(shape),
            "name": name_point(outline, region_names.get(region, region)),
            "view": view,
            "scale": r2(scale),
        }
        laid_out = layout_places(arts, names, radius * scale, scale, land)
        for location in SWAPPED & laid_out.keys():
            laid_out[location] = swapped(
                laid_out[location],
                find(places, f"illustration-{location}"),
                scale,
                shifts[location],
            )
        separate(laid_out)
        write_svg(MAPS_DIR / f"places-{region}.svg", places)
        for location, placed in laid_out.items():
            placed.pop("stackWidth", None)
            geometry["locations"][location] = {
                "regionId": region,
                "dot": {"cx": r2(dots[location][0]), "cy": r2(dots[location][1])},
                **placed,
            }

        # Places, fog, decorations and chips are drawn in their own layers.
        for child in list(group):
            child_id = child.get("id") or ""
            if child_id.startswith(("location-", "overlay-fog-", "status-region-", "decorations-")):
                group.remove(child)

    replace_neighbours(by_id, tree_map, country, geometry["neighbours"])
    remove_ids(tree_map, REMOVED_IDS)
    write_svg(MAPS_DIR / "base.svg", wrap(tree_map))
    write_geometry(geometry)


# Zoomed in on a region, the markers and names are drawn this much larger on
# screen than the whole map would draw them, and shrink in the map's own units
# by the zoom: so they never crowd, and stay big enough for small fingers.
ZOOMED_SIZE = 1.15

# Room around a region's outline and buildings when the map zooms to it.
ZOOM_PADDING = 50


def zoom_view(box: dict[str, float]) -> dict[str, float]:
    """A region's box with some room, widened to the map's shape and kept on it."""
    _, _, map_width, map_height = VIEW_BOX
    ratio = map_width / map_height
    x = box["x"] - ZOOM_PADDING
    y = box["y"] - ZOOM_PADDING
    width = box["width"] + ZOOM_PADDING * 2
    height = box["height"] + ZOOM_PADDING * 2
    if width / height < ratio:
        wider = height * ratio
        x, width = x - (wider - width) / 2, wider
    else:
        taller = width / ratio
        y, height = y - (taller - height) / 2, taller
    width, height = min(width, map_width), min(height, map_height)
    x = min(max(x, 0), map_width - width)
    y = min(max(y, 0), map_height - height)
    return {"x": r2(x), "y": r2(y), "width": r2(width), "height": r2(height)}


# A region's name on the whole map, as MontenegroMap.tsx draws it: this size,
# on two lines when it is longer than this many letters.
REGION_NAME_SIZE = 34
REGION_NAME_WRAP = 12


def name_lines(name: str) -> list[str]:
    """The name on one line, or on two split at the space nearest its middle."""
    if len(name) <= REGION_NAME_WRAP or " " not in name:
        return [name]
    spaces = [i for i, c in enumerate(name) if c == " "]
    split = min(spaces, key=lambda i: abs(i - len(name) / 2))
    return [name[:split], name[split + 1 :]]


def name_point(polygon: list[tuple[float, float]], name: str) -> dict[str, float]:
    """Where a region's name fits inside it, as far from its edges as can be.

    Its centre, with room for the lock before it. Falls back to the roomiest
    point when the name fits nowhere whole.
    """
    lines = name_lines(name)
    width = max(len(line) for line in lines) * REGION_NAME_SIZE * 0.55 + 40
    height = len(lines) * REGION_NAME_SIZE * 1.1
    xs = [x for x, _ in polygon]
    ys = [y for _, y in polygon]
    best, best_room = None, -1.0
    steps = 60
    for i in range(1, steps):
        for j in range(1, steps):
            cx = min(xs) + (max(xs) - min(xs)) * i / steps
            cy = min(ys) + (max(ys) - min(ys)) * j / steps
            corners = [
                (cx + dx * width / 2, cy + dy * height / 2)
                for dx in (-1, 0, 1)
                for dy in (-1, 0, 1)
            ]
            if not all(inside(corner, polygon) for corner in corners):
                continue
            room = min(edge_distance((cx, cy), a, b) for a, b in edges(polygon))
            if room > best_room:
                best, best_room = {"x": r2(cx), "y": r2(cy)}, room
    return best or interior_point(polygon)


def on_land(point: tuple[float, float], land: list[tuple[float, float]]) -> tuple[float, float]:
    """`point`, or the nearest point to it on land, a little way in."""
    if inside(point, land):
        return point
    x, y = point
    for radius in range(4, 120, 4):
        for step in range(16):
            angle = step * pi / 8
            candidate = (x + radius * cos(angle), y + radius * sin(angle))
            if inside(candidate, land) and inside(
                (candidate[0] + 6 * cos(angle), candidate[1] + 6 * sin(angle)), land
            ):
                return (candidate[0] + 6 * cos(angle), candidate[1] + 6 * sin(angle))
    return point


def shrink(
    element: ET.Element, scale: float, shift: tuple[float, float] = (0, 0)
) -> dict[str, float]:
    """Scales `element` by `scale` around its centre, then moves it by
    `shift`; returns its new box."""
    box = bbox_of(element)
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    dx, dy = shift
    element.set(
        "transform",
        f"translate({r2(cx + dx)} {r2(cy + dy)}) scale({r2(scale)}) "
        f"translate({r2(-cx)} {r2(-cy)})",
    )
    width, height = box["width"] * scale, box["height"] * scale
    return {
        "x": r2(cx + dx - width / 2),
        "y": r2(cy + dy - height / 2),
        "width": r2(width),
        "height": r2(height),
    }


# Land a region gives to another, as (from, to, area): everything of `from`
# inside `area` becomes `to`'s. Obala is a strip along the sea: the border
# with Centralna Crna Gora runs from above the Bay of Kotor down to the
# Albanian border, as drawn on the map (north-east of it is Centralna's).
COAST_BORDER = [
    (480, 574),
    (529, 575),
    (573, 589),
    (616, 610),
    (649, 638),
    (676, 665),
    (703, 692),
    (730, 719),
    (758, 741),
    (790, 768),
    (812, 795),
    (834, 822),
    (855, 866),
    (872, 909),
    (883, 931),
    (900, 1000),
]
REGION_STRIPS = [
    ("coast", "central", [(480, 0), *COAST_BORDER, (1600, 1000), (1600, 0)]),
]


def move_strips(shapes: dict) -> None:
    for giver, taker, area in REGION_STRIPS:
        given = Polygon(area)
        strip = shapes[giver].intersection(given)
        shapes[giver] = tidy(shapes[giver].difference(given))
        shapes[taker] = tidy(unary_union([shapes[taker], strip]))


def tidy(shape):
    """`shape` with hairline seams closed and slivers dropped."""
    return shape.buffer(0.5, join_style="mitre").buffer(-0.5, join_style="mitre")


# The borders between regions, drawn as straight lines in the export, bend
# gently instead: every point of a border moves by a smooth wave of the map
# (this far at most, in map units), the same for both regions that share it,
# so they still meet. The country's own border, the coast and the lake's shore
# stay put; a border bends less the nearer it comes to them.
BORDER_WAVE = 5.0
BORDER_STEP = 3.0
BORDER_EASE = 14.0


def wave(x: float, y: float) -> tuple[float, float]:
    dx = sin(x / 31 + y / 19) + 0.5 * sin(y / 11 - x / 23 + 1.7)
    dy = sin(x / 23 - y / 29 + 2.1) + 0.5 * sin(x / 13 + y / 17 + 0.4)
    return dx * BORDER_WAVE / 1.5, dy * BORDER_WAVE / 1.5


def naturalise(shapes: dict, keep: list) -> dict:
    fixed = unary_union(keep)

    def bend(ring) -> list[tuple[float, float]]:
        coords = list(ring.coords)
        points = []
        for (x1, y1), (x2, y2) in zip(coords, coords[1:], strict=False):
            length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            steps = max(1, int(length / BORDER_STEP + 0.999))
            for step in range(steps):
                f = step / steps
                x, y = x1 + (x2 - x1) * f, y1 + (y2 - y1) * f
                ease = min(1.0, max(0.0, (fixed.distance(Point(x, y)) - 1) / BORDER_EASE))
                dx, dy = wave(x, y)
                points.append((x + dx * ease, y + dy * ease))
        return points

    bent = {}
    for region, shape in shapes.items():
        polygons = shape.geoms if isinstance(shape, MultiPolygon) else [shape]
        bent[region] = tidy(
            unary_union(
                [
                    Polygon(
                        bend(polygon.exterior), [bend(hole) for hole in polygon.interiors]
                    ).buffer(0)
                    for polygon in polygons
                ]
            )
        )
    return bent


# The land around Montenegro: one landscape with no borders between the
# countries (the export's were not accurate), muted and darker than
# Montenegro's so it reads as out of play. Scenery like Montenegro's is
# scattered over it.
NEIGHBOUR_PARTS = (
    "neighbours",
    "neighbours-extend-west",
    "neighbours-extend-east",
    "coastline-extend-west",
)
SURROUNDING_LAND = "#A9DE6F"
SURROUNDING_SPACING = 46
SURROUNDING_CLEARANCE = 14


def muted(colour: str | None) -> str | None:
    """`colour` as the surroundings draw it: much greyer and darker."""
    if colour == "white":
        colour = "#FFFFFF"
    if colour is None or not colour.startswith("#"):
        return colour
    r, g, b = (int(colour[i : i + 2], 16) / 255 for i in (1, 3, 5))
    h, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, lightness * 0.72 + 0.04, saturation * 0.25)
    return "#" + "".join(f"{round(v * 255):02X}" for v in (r, g, b))


def mute_element(element: ET.Element) -> None:
    for el in element.iter():
        for attribute in ("fill", "stroke"):
            if el.get(attribute) not in (None, "none"):
                el.set(attribute, muted(el.get(attribute)))
        el.attrib.pop("id", None)


def box_polygon(box: dict[str, float], pad: float = 0) -> Polygon:
    left, top = box["x"] - pad, box["y"] - pad
    right, bottom = box["x"] + box["width"] + pad, box["y"] + box["height"] + pad
    return Polygon([(left, top), (right, top), (right, bottom), (left, bottom)])


def replace_neighbours(by_id: dict, tree_map: ET.Element, country, labels: dict) -> None:
    parts = [by_id[part] for part in NEIGHBOUR_PARTS if part in by_id]
    background = parent_of(tree_map, parts[0])
    index = list(background).index(parts[0])
    shapes = []
    for part in parts:
        if part.tag == f"{NS}rect":
            shapes.append(box_polygon(rect_of(part)))
        elif part.get("fill") not in (None, "none") or part.tag == f"{NS}g":
            shapes += [shape for shape in polygons_of(part) if shape.area > 1]
        parent_of(tree_map, part).remove(part)
    view = box_polygon({"x": 0, "y": 0, "width": VIEW_BOX[2], "height": VIEW_BOX[3]})
    land = tidy(unary_union(shapes)).difference(country).intersection(view)

    group = ET.Element(f"{NS}g", {"id": "surroundings"})
    ET.SubElement(
        group,
        f"{NS}path",
        {
            "d": path_data(land),
            "fill": muted(SURROUNDING_LAND),
            "stroke": muted("#2B2D42"),
            "stroke-width": "2",
            "stroke-linejoin": "round",
        },
    )
    templates = [el for scenery in ("scenery-north", "scenery-central") for el in by_id[scenery]]
    trees = [el for el in templates if el.get("id", "").startswith("tree")]
    others = [el for el in templates if not el.get("id", "").startswith("tree")]
    keep_out = unary_union(
        [country.buffer(SURROUNDING_CLEARANCE)] + [box_polygon(box, 12) for box in labels.values()]
    )
    room = land.buffer(-4).difference(keep_out)
    rng = random.Random(7)
    scenery = ET.SubElement(group, f"{NS}g")
    for gy in range(0, VIEW_BOX[3], SURROUNDING_SPACING):
        for gx in range(0, VIEW_BOX[2], SURROUNDING_SPACING):
            template = rng.choice(others if rng.random() < 0.18 else trees)
            box = bbox_of(template)
            scale = rng.uniform(0.75, 1.15)
            x = gx + rng.uniform(0, SURROUNDING_SPACING)
            y = gy + rng.uniform(0, SURROUNDING_SPACING)
            footprint = box_polygon(
                {"x": x, "y": y, "width": box["width"] * scale, "height": box["height"] * scale}
            )
            if not room.contains(footprint) or rng.random() < 0.3:
                continue
            placed = ET.SubElement(
                scenery,
                f"{NS}g",
                {
                    "transform": f"translate({r2(x - box['x'] * scale)} "
                    f"{r2(y - box['y'] * scale)}) scale({r2(scale)})"
                },
            )
            piece = copy.deepcopy(template)
            mute_element(piece)
            placed.append(piece)
    background.insert(index, group)


def subpaths(d: str) -> list[str]:
    return [part for part in re.split(r"(?=[Mm])", d) if part.strip()]


def polygons_of(element: ET.Element) -> list[Polygon]:
    """Every closed shape of every path under `element`, one per subpath."""
    found = []
    for path in element.iter(f"{NS}path"):
        for part in subpaths(path.get("d", "")):
            points = path_points(part)
            if len(points) >= 3:
                found.append(Polygon(points).buffer(0))
    return found


def polygon_of(element: ET.Element):
    return unary_union(polygons_of(element))


def merged(shape_group: ET.Element):
    """A region's fill, its pieces made one: a hair wider then narrower again,
    which closes the seams between them."""
    fill = first_path(shape_group)
    pieces = [
        Polygon(path_points(part)).buffer(0)
        for part in subpaths(fill.get("d", ""))
        if len(path_points(part)) >= 3
    ]
    return unary_union(pieces).buffer(0.5, join_style="mitre").buffer(-0.5, join_style="mitre")


def largest(shape) -> Polygon:
    if isinstance(shape, MultiPolygon):
        return max(shape.geoms, key=lambda polygon: polygon.area)
    return shape


def path_data(shape) -> str:
    """An SVG path for a (multi)polygon, holes included."""
    polygons = shape.geoms if isinstance(shape, MultiPolygon) else [shape]
    parts = []
    for polygon in polygons:
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)[:-1]
            parts.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in coords) + " Z")
    return " ".join(parts)


def redraw_region(shape_group: ET.Element, shape) -> None:
    fill = first_path(shape_group).get("fill", "#C6EA82")
    for child in list(shape_group):
        shape_group.remove(child)
    ET.SubElement(shape_group, f"{NS}path", {"d": path_data(shape), "fill": fill})
    ET.SubElement(
        shape_group,
        f"{NS}path",
        {
            "d": path_data(shape),
            "fill": "none",
            "stroke": "white",
            "stroke-width": str(REGION_BORDER_WIDTH),
            "stroke-linejoin": "round",
        },
    )


def parent_of(root: ET.Element, element: ET.Element) -> ET.Element:
    for parent in root.iter():
        if element in list(parent):
            return parent
    raise SystemExit(f"#{element.get('id')} has no parent")


def stack_box(placed: dict) -> dict[str, float]:
    """The box around a place's marker and its name pill."""
    marker, label = placed["marker"], placed["label"]
    top = marker["cy"] - marker["r"]
    bottom = label["cy"] + label["height"] / 2
    width = placed["stackWidth"]
    return {"x": label["cx"] - width / 2, "y": top, "width": width, "height": bottom - top}


def separate(laid_out: dict[str, dict]) -> None:
    """Pushes any marker and name that still overlaps another's away from it.

    The swapped coastal towns' markers go where their towns are, which around
    the Bay of Kotor can be closer together than a marker is big. Each later
    place moves away from the earlier one it overlaps, a step at a time, until
    the two are clear (or it has moved a marker's height).
    """
    names = list(laid_out)
    for index, location in enumerate(names):
        placed = laid_out[location]
        for _ in range(40):
            box = stack_box(placed)
            others = [stack_box(laid_out[other]) for other in names[:index]]
            hit = next((other for other in others if overlap(box, other) > 0), None)
            if hit is None:
                break
            dx = (box["x"] + box["width"] / 2) - (hit["x"] + hit["width"] / 2)
            dy = (box["y"] + box["height"] / 2) - (hit["y"] + hit["height"] / 2)
            length = max((dx * dx + dy * dy) ** 0.5, 0.01)
            step = (dx / length * 1.5, dy / length * 1.5)
            placed = {
                **placed,
                "marker": {
                    **placed["marker"],
                    "cx": r2(placed["marker"]["cx"] + step[0]),
                    "cy": r2(placed["marker"]["cy"] + step[1]),
                },
                "label": {
                    **placed["label"],
                    "cx": r2(placed["label"]["cx"] + step[0]),
                    "cy": r2(placed["label"]["cy"] + step[1]),
                },
            }
        placed["hitArea"] = union([placed["art"], stack_box(placed)])
        laid_out[location] = placed


def swapped(
    placed: dict, illustration: ET.Element, scale: float, shift: tuple[float, float]
) -> dict:
    """`placed` with its art and its marker and name trading places."""
    art, marker, label = placed["art"], placed["marker"], placed["label"]
    top = marker["cy"] - marker["r"]
    bottom = label["cy"] + label["height"] / 2
    delta = (
        label["cx"] - (art["x"] + art["width"] / 2),
        (top + bottom) / 2 - (art["y"] + art["height"] / 2),
    )
    new_art = shrink(illustration, scale, (shift[0] + delta[0], shift[1] + delta[1]))
    new_marker = {**marker, "cx": r2(marker["cx"] - delta[0]), "cy": r2(marker["cy"] - delta[1])}
    new_label = {**label, "cx": r2(label["cx"] - delta[0]), "cy": r2(label["cy"] - delta[1])}
    width = placed["stackWidth"]
    stack = {
        "x": new_label["cx"] - width / 2,
        "y": new_marker["cy"] - marker["r"],
        "width": width,
        "height": bottom - top,
    }
    return {
        **placed,
        "art": new_art,
        "marker": new_marker,
        "label": new_label,
        "hitArea": union([new_art, stack]),
    }


def moved(box: dict[str, float], shift: tuple[float, float]) -> dict[str, float]:
    return {**box, "x": r2(box["x"] + shift[0]), "y": r2(box["y"] + shift[1])}


def first_path(group: ET.Element) -> ET.Element:
    path = group if group.tag == f"{NS}path" else group.find(f".//{NS}path")
    if path is None:
        raise SystemExit(f"#{group.get('id')} has no path")
    return path


def interior_point(polygon: list[tuple[float, float]]) -> dict[str, float]:
    """The point inside `polygon` farthest from its edges, for its name.

    A region's box centre can fall outside a thin or curved region (the
    coast); this finds the roomiest spot on a grid instead.
    """
    xs = [x for x, _ in polygon]
    ys = [y for _, y in polygon]
    best, best_room = (sum(xs) / len(xs), sum(ys) / len(ys)), -1.0
    steps = 60
    for i in range(1, steps):
        for j in range(1, steps):
            point = (
                min(xs) + (max(xs) - min(xs)) * i / steps,
                min(ys) + (max(ys) - min(ys)) * j / steps,
            )
            if not inside(point, polygon):
                continue
            room = min(edge_distance(point, a, b) for a, b in edges(polygon))
            if room > best_room:
                best, best_room = point, room
    return {"x": r2(best[0]), "y": r2(best[1])}


def edges(polygon: list[tuple[float, float]]):
    return zip(polygon, polygon[1:] + polygon[:1], strict=True)


def edge_distance(point, a, b) -> float:
    (px, py), (ax, ay), (bx, by) = point, a, b
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    t = 0.0 if length == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


# The name pill, as the app draws it (MontenegroMap.tsx): the export's height,
# and a width that grows with the name.
LABEL_HEIGHT = 28.5
LABEL_FONT_SIZE = 15
CONTENT_PATH = WEB_ROOT.parent / "api" / "app" / "modules" / "content" / "data" / "content.json"

# Where a place's marker and name may sit around its art, in order of
# preference.
SIDES = ("above", "below", "right", "left")

# Where the crowded places go, chosen by eye: around the Bay of Kotor and the
# south coast the art is too close together for the automatic choice.
# Skadarsko jezero's name on the lake, under its pelican, not on the land
# beside it (the lake counts as "not land" for the automatic choice).
SIDE_OVERRIDES: dict[str, str] = {"skadar-lake": "below"}


def place_names(kind: str = "locations") -> dict[str, str]:
    """Names from the content, which decide how much room each label needs."""
    content = json.loads(CONTENT_PATH.read_text())
    return {item["slug"]: item["name"] for item in content[kind]}


def label_width(name: str, scale: float) -> float:
    return (len(name) * LABEL_FONT_SIZE * 0.68 + 26) * scale


def layout_places(
    arts: dict[str, dict[str, float]],
    names: dict[str, str],
    radius: float,
    scale: float,
    land: list[tuple[float, float]],
) -> dict[str, dict]:
    """One region's places' markers, names and hit areas, beside their art.

    Sizes are in the map's units at the region's zoom: `scale` times the size
    the whole map would draw them.

    The export puts some coastal markers out at sea, joined to their town by a
    leader line. Here each place's marker and name (the marker over its name
    pill) go on whichever side of its art keeps them on land and clear of
    every other place's art, marker and name, preferring above.
    """
    # Art that is not drawn takes no room; its place goes last, into the room
    # the drawn places leave, as near to where its art was as it fits.
    taken: list[dict[str, float]] = [
        art for location, art in arts.items() if location not in HIDDEN_ART
    ]
    placed: dict[str, dict] = {}
    order = sorted(arts, key=lambda location: location in HIDDEN_ART)
    for location in order:
        art = arts[location]
        width = max(label_width(names.get(location, location), scale), radius * 2)
        if location in SIDE_OVERRIDES:
            sides = (SIDE_OVERRIDES[location],)
        elif location in HIDDEN_ART:
            sides = ("on", *SIDES)
        else:
            sides = SIDES
        best = min(
            (stack_for(art, side, width, radius, scale) for side in sides),
            key=lambda stack: stack_cost(stack, art, taken, land),
        )
        taken.append(best["box"])
        marker, label, box = best["marker"], best["label"], best["box"]
        if location in HIDDEN_ART:
            # Nothing is drawn there but the marker and name.
            art = box
        hit = union([art, box])
        placed[location] = {
            "art": art,
            "marker": marker,
            "label": label,
            "hitArea": hit,
            # For separate(), then dropped: how wide the marker and name are.
            "stackWidth": r2(width),
        }
    return placed


def stack_for(art: dict[str, float], side: str, width: float, radius: float, scale: float) -> dict:
    label_height = LABEL_HEIGHT * scale
    height = radius * 2 + label_height - 2 * scale
    art_cx = art["x"] + art["width"] / 2
    art_cy = art["y"] + art["height"] / 2
    if side == "on":
        x, y = art_cx - width / 2, art_cy - height / 2
    elif side == "above":
        x, y = art_cx - width / 2, art["y"] - height + 8 * scale
    elif side == "below":
        x, y = art_cx - width / 2, art["y"] + art["height"] - 8 * scale
    elif side == "right":
        x, y = art["x"] + art["width"] + 4 * scale, art_cy - height / 2
    else:
        x, y = art["x"] - width - 4 * scale, art_cy - height / 2
    cx = x + width / 2
    return {
        # "on" (where hidden art was) is preferred, then the SIDES in order.
        "side": SIDES.index(side) + 1 if side in SIDES else 0,
        "marker": {"cx": r2(cx), "cy": r2(y + radius), "r": r2(radius)},
        "label": {
            "cx": r2(cx),
            "cy": r2(y + height - label_height / 2),
            "height": r2(label_height),
            "fontSize": r2(LABEL_FONT_SIZE * scale),
        },
        "box": {"x": r2(x), "y": r2(y), "width": r2(width), "height": r2(height)},
    }


def stack_cost(
    stack: dict,
    art: dict[str, float],
    taken: list[dict[str, float]],
    land: list[tuple[float, float]],
) -> float:
    box = stack["box"]
    crowding = sum(overlap(box, other) for other in taken if other is not art)
    corners = [
        (box["x"] + dx * box["width"], box["y"] + dy * box["height"])
        for dx in (0, 0.5, 1)
        for dy in (0, 0.5, 1)
    ]
    at_sea = sum(not inside(point, land) for point in corners)
    area = box["width"] * box["height"]
    # Covering another place is worse than reaching into the sea.
    return crowding / area * 1000 + at_sea * 20 + stack["side"]


def overlap(a: dict[str, float], b: dict[str, float]) -> float:
    width = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
    height = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
    return max(width, 0) * max(height, 0)


def inside(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    x, y = point
    result = False
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1], strict=True):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            result = not result
    return result


def union(boxes: list[dict[str, float]]) -> dict[str, float]:
    left = min(b["x"] for b in boxes)
    top = min(b["y"] for b in boxes)
    right = max(b["x"] + b["width"] for b in boxes)
    bottom = max(b["y"] + b["height"] for b in boxes)
    return {"x": r2(left), "y": r2(top), "width": r2(right - left), "height": r2(bottom - top)}


def r2(value: float) -> float:
    return round(value, 2)


def find(root: ET.Element, element_id: str) -> ET.Element:
    found = root.find(f".//*[@id='{element_id}']")
    if found is None:
        raise SystemExit(f"The export has no #{element_id}")
    return found


def remove_ids(root: ET.Element, ids: set[str]) -> None:
    for parent in list(root.iter()):
        for child in list(parent):
            if child.get("id") in ids:
                parent.remove(child)


def new_svg() -> ET.Element:
    x, y, w, h = VIEW_BOX
    return ET.Element(f"{NS}svg", {"viewBox": f"{x} {y} {w} {h}", "fill": "none"})


def wrap(element: ET.Element) -> ET.Element:
    svg = new_svg()
    svg.append(copy.deepcopy(element))
    return svg


def write_svg(path: Path, svg: ET.Element) -> None:
    # Drop shadows only sat on the markers, which the app draws; any filter
    # left would point at a <defs> the art no longer has.
    for el in svg.iter():
        el.attrib.pop("filter", None)
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(svg).write(path, encoding="unicode", xml_declaration=False)
    print(f"wrote {path.relative_to(WEB_ROOT)} ({path.stat().st_size // 1024} KB)")


def child_rect(group: ET.Element) -> ET.Element:
    rect = group.find(f".//{NS}rect")
    if rect is None:
        raise SystemExit(f"#{group.get('id')} has no rect")
    return rect


def rect_of(element: ET.Element) -> dict[str, float]:
    if element.tag == f"{NS}rect":
        return {
            "x": num(element.get("x", "0")),
            "y": num(element.get("y", "0")),
            "width": num(element.get("width")),
            "height": num(element.get("height")),
        }
    return bbox_of(element)


def bbox_of(element: ET.Element) -> dict[str, float]:
    """The box around every point of every path and rect under `element`.

    Curve control points count too, so a curved edge may make the box a
    little larger than the shape: good enough for placing and zooming.
    """
    xs: list[float] = []
    ys: list[float] = []
    for el in element.iter():
        if el.tag == f"{NS}path":
            for x, y in path_points(el.get("d", "")):
                xs.append(x)
                ys.append(y)
        elif el.tag == f"{NS}rect":
            r = rect_of(el)
            xs += [r["x"], r["x"] + r["width"]]
            ys += [r["y"], r["y"] + r["height"]]
    if not xs:
        raise SystemExit(f"#{element.get('id')} has no geometry")
    return {
        "x": round(min(xs), 2),
        "y": round(min(ys), 2),
        "width": round(max(xs) - min(xs), 2),
        "height": round(max(ys) - min(ys), 2),
    }


TOKEN = re.compile(r"[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?")
ARG_COUNTS = {"M": 2, "L": 2, "T": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "A": 7, "Z": 0}


def path_points(d: str) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    x = y = start_x = start_y = 0.0
    command = "M"
    tokens = TOKEN.findall(d)
    i = 0
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]
            i += 1
            if command in "Zz":
                x, y = start_x, start_y
                continue
        upper = command.upper()
        count = ARG_COUNTS[upper]
        args = [float(t) for t in tokens[i : i + count]]
        i += count
        relative = command.islower()
        if upper == "H":
            x = args[0] + (x if relative else 0)
        elif upper == "V":
            y = args[0] + (y if relative else 0)
        elif upper == "A":
            x, y = args[5] + (x if relative else 0), args[6] + (y if relative else 0)
        else:
            pairs = list(zip(args[0::2], args[1::2], strict=True))
            for px, py in pairs[:-1]:
                points.append((px + (x if relative else 0), py + (y if relative else 0)))
            last_x, last_y = pairs[-1]
            x, y = last_x + (x if relative else 0), last_y + (y if relative else 0)
        points.append((x, y))
        if upper == "M":
            start_x, start_y = x, y
            # Coordinates after a moveto are lineto.
            command = "l" if relative else "L"
    return points


def num(value: str | None) -> float:
    return round(float(value or 0), 2)


def write_geometry(geometry: dict) -> None:
    body = json.dumps(geometry, indent=2, ensure_ascii=False)
    GEOMETRY_PATH.write_text(
        "// Generated by scripts/build_map.py from the Figma map export. Do not\n"
        "// edit: export the map again and rerun the script.\n"
        "//\n"
        "// Positions in the map's viewBox, for what the app draws over the art.\n"
        f"export const MAP_GEOMETRY = {body} as const;\n"
    )
    print(f"wrote {GEOMETRY_PATH.relative_to(WEB_ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
