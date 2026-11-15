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

from shapely.affinity import translate
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
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
# shore of Tivat's bay; Kotor at the far end of its inlet; Ulcinj 70% of the
# way from Bar to the Bojana, at the border.
COASTAL_TOWNS = {
    "herceg-novi": (535, 646),
    "kotor": (637, 673),
    "tivat": (604, 659),
    "budva": (654, 710),
    "bar": (762, 816),
    "ulcinj": (835, 925),
}

# Inland places the export draws away from where they are, moved to their
# real place as the map's coast frames it: Cetinje, inland between Kotor and
# Budva, just north of the coast's border.
INLAND_TOWNS = {
    "cetinje": (684, 660),
}

MOVED_TOWNS = set(COASTAL_TOWNS) | set(INLAND_TOWNS)

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

    bay_land, bay_water = reshape_bay(by_id)
    land = path_points(by_id["country-outline"].get("d", ""))
    # Only Montenegro's part of the lake: the export draws all of it, half in
    # Albania, outside the region's fog.
    lake = polygon_of(by_id["skadar-lake-water"]).intersection(polygon_of(by_id["country-outline"]))
    by_id["skadar-lake-water"].set("d", path_data(lake))
    shapes = {region: merged(by_id[f"region-{region}-shape"]) for region in regions}
    shapes["coast"] = unary_union([shapes["coast"], bay_land])
    shapes = {region: tidy(shape.difference(bay_water)) for region, shape in shapes.items()}
    for region, shape in shapes.items():
        # The lake is the central region's: no other region reaches under it.
        if by_id[f"region-{region}"].find(".//*[@id='skadar-lake-water']") is None:
            shapes[region] = shape.difference(lake)
    move_strips(shapes)
    country = polygon_of(by_id["country-outline"])
    left, top, right, bottom = country.bounds
    geometry["focus"] = focus_box(
        {"x": left, "y": top, "width": right - left, "height": bottom - top}
    )
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
            elif location in INLAND_TOWNS:
                dot = INLAND_TOWNS[location]
            else:
                dot = on_land(centre, land)
            # A place moved to the shore, or inland, takes its building with it.
            shifts[location] = (dot[0] - centre[0], dot[1] - centre[1])
            if location in MOVED_TOWNS:
                art = moved(art, shifts[location])
            dots[location] = dot
            if location in HIDDEN_ART:
                # Nothing is drawn: only the place's marker and name.
                art = {"x": dot[0], "y": dot[1], "width": 0, "height": 0}
            arts[location] = art
        left, top, right, bottom = shape.bounds
        shape_box = {"x": left, "y": top, "width": right - left, "height": bottom - top}
        region_box = union([shape_box, *arts.values()])
        view = zoom_view(region_box)
        scale = min(1.0, view["width"] / VIEW_BOX[2] * ZOOMED_SIZE)

        # Zoomed in, the buildings would be drawn as much larger as the zoom;
        # each shrinks around its own centre by the same scale as the markers
        # and names, so it looks about the size it has on the whole map.
        for location in arts:
            if location not in HIDDEN_ART:
                shift = shifts[location] if location in MOVED_TOWNS else (0, 0)
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
            "focus": focus_box(region_box),
            "scale": r2(scale),
        }
        laid_out = layout_places(
            arts,
            dots,
            names,
            radius * scale,
            scale,
            unary_union([others, neighbours]),
            movable=set(arts) - MOVED_TOWNS,
        )
        # A town that moved to fit is on the whole map where it is zoomed in.
        for location, placed in laid_out.items():
            dots[location] = (placed["marker"]["cx"], placed["marker"]["cy"])
        for location, placed in laid_out.items():
            if location not in HIDDEN_ART:
                illustration = find(places, f"illustration-{location}")
                drawn = bbox_of(illustration)
                art = placed["art"]
                shrink(
                    illustration,
                    scale,
                    (
                        art["x"] + art["width"] / 2 - (drawn["x"] + drawn["width"] / 2),
                        art["y"] + art["height"] / 2 - (drawn["y"] + drawn["height"] / 2),
                    ),
                )
        write_svg(MAPS_DIR / f"places-{region}.svg", places)
        for location, placed in laid_out.items():
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

    replace_neighbours(by_id, tree_map, country, geometry["neighbours"], bay_water)
    remove_ids(tree_map, REMOVED_IDS)
    base = new_svg(BASE_BOX)
    base.append(copy.deepcopy(tree_map))
    write_svg(MAPS_DIR / "base.svg", base)
    geometry["baseBox"] = list(BASE_BOX)
    write_geometry(geometry)


# Zoomed in on a region, the markers and names are drawn this much larger on
# screen than the whole map would draw them, and shrink in the map's own units
# by the zoom: so they never crowd, and stay big enough for small fingers.
ZOOMED_SIZE = 1.15

# Room around a region's outline and buildings when the map zooms to it.
ZOOM_PADDING = 50


def focus_box(box: dict[str, float]) -> dict[str, float]:
    """What the app fits on the screen: `box` with some room, at its own shape."""
    return {
        "x": r2(box["x"] - ZOOM_PADDING),
        "y": r2(box["y"] - ZOOM_PADDING),
        "width": r2(box["width"] + ZOOM_PADDING * 2),
        "height": r2(box["height"] + ZOOM_PADDING * 2),
    }


def zoom_view(box: dict[str, float]) -> dict[str, float]:
    """A region's box with some room, widened to the map's shape and kept on it:
    how much a 16:10 screen zooms in on it, which sizes the buildings."""
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
    (573, 582),
    (616, 600),
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


# The Bay of Kotor, which the export draws as a thin channel, traced from a
# real map (in that map's pixels, west to east along the north shore, then
# back along the south): Herceg Novi's shore, the Verige strait, the Risan
# and Kotor arms (Kotor at the far end of its arm), and Tivat's bay with the
# Luštica peninsula below it. Its mouth runs on out to sea, past the coast,
# and Kotor's inlet is a little wider than life, to show between its shores.
BAY_TRACE = [
    (-60, 385), (0, 392), (60, 392), (110, 396), (140, 405), (165, 410), (200, 400),
    (240, 395), (280, 385), (300, 370), (316, 352), (322, 338), (300, 315), (278, 302),
    (290, 290), (312, 268), (332, 235), (345, 236), (352, 262), (348, 295), (352, 316),
    (410, 311), (468, 298), (468, 335), (470, 370), (482, 400), (500, 440), (503, 470),
    (480, 470), (470, 440), (458, 408), (445, 379), (430, 359), (392, 343), (345, 338),
    (336, 350), (332, 362), (338, 385), (348, 410), (356, 432), (370, 460), (385, 476),
    (386, 495), (372, 506), (340, 492), (300, 482), (260, 472), (200, 466), (150, 456),
    (110, 447), (88, 455), (80, 470), (-60, 475),
]
# Where the trace's mouth (0, 395) goes on the map, and its scale: true to
# the map's coast from west to east (Herceg Novi to Kotor), but taller than
# life, since the map squashes the coast from north to south.
BAY_ORIGIN = (526, 648)
BAY_SCALE = (0.22, 0.3)
# Straits narrower than this, in the map's units, would close under the
# coast's ink line.
BAY_MIN_WIDTH = 4
# The export's own channel, filled in as land before the bay is cut.
BAY_OLD_CHANNEL = {"x": 528, "y": 630, "width": 112, "height": 58}


def reshape_bay(by_id: dict):
    """Redraws the Bay of Kotor in the country's outline and its shadow, and
    returns the land filled in and the bay's water, for the regions."""
    outline = by_id["country-outline"]
    country = polygon_of(outline)
    shadow_element = by_id["country-shadow"]
    shadow = polygon_of(shadow_element)
    dx = shadow.bounds[0] - country.bounds[0]
    dy = shadow.bounds[1] - country.bounds[1]
    ox, oy = BAY_ORIGIN
    sx, sy = BAY_SCALE
    water = Polygon([(ox + x * sx, oy + (y - 395) * sy) for x, y in BAY_TRACE]).buffer(
        BAY_MIN_WIDTH / 2
    )
    filled = country.convex_hull.intersection(box_polygon(BAY_OLD_CHANNEL)).difference(country)
    reshaped = largest(unary_union([country, filled]).difference(water))
    outline.set("d", path_data(reshaped))
    # The land's shadow falls on the open sea, not into the bay.
    shadow_element.set("d", path_data(translate(reshaped, dx, dy).difference(water)))
    return filled, water


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


def replace_neighbours(
    by_id: dict, tree_map: ET.Element, country, labels: dict, bay_water
) -> None:
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
    land = (
        extruded(tidy(unary_union(shapes)).intersection(view))
        .difference(country)
        .difference(bay_water)
    )
    sea = by_id["sea"]
    for key, value in zip(("x", "y", "width", "height"), BASE_BOX, strict=True):
        sea.set(key, str(value))

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
    # Each piece is drawn once, muted, and placed by reference.
    defs = ET.SubElement(group, f"{NS}defs")
    piece_ids = {}
    for number, template in enumerate(templates):
        piece = copy.deepcopy(template)
        mute_element(piece)
        for el in piece.iter():
            el.attrib.pop("id", None)
        piece.set("id", f"scenery-piece-{number}")
        defs.append(piece)
        piece_ids[id(template)] = piece.get("id")
    scenery = ET.SubElement(group, f"{NS}g")
    x0, y0, width, height = BASE_BOX
    for gy in range(y0, y0 + height, SURROUNDING_SPACING):
        for gx in range(x0, x0 + width, SURROUNDING_SPACING):
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
            ET.SubElement(
                scenery,
                f"{NS}use",
                {
                    "href": f"#{piece_ids[id(template)]}",
                    "transform": f"translate({r2(x - box['x'] * scale)} "
                    f"{r2(y - box['y'] * scale)}) scale({r2(scale)})",
                },
            )
    background.insert(index, group)


# The surroundings go on past the export's edges this far on every side, so
# the art fills a screen of any shape around the country.
BASE_MARGIN = 800
BASE_BOX = (
    -BASE_MARGIN,
    -BASE_MARGIN,
    VIEW_BOX[2] + BASE_MARGIN * 2,
    VIEW_BOX[3] + BASE_MARGIN * 2,
)


EDGE_INSET = 3


def extruded(land):
    """`land` (inside the export) carried on straight past each edge of the
    export to BASE_BOX's: land where the edge is land, sea where it is sea."""
    _, _, width, height = VIEW_BOX
    m = BASE_MARGIN
    pieces = [land]
    # Each edge, read a little inside it (the export's land can stop just
    # short of its edge), and the strip beyond it it extends into.
    i = EDGE_INSET
    for edge, along_x, low, high in (
        (((0, i), (width, i)), True, -m, i),
        (((0, height - i), (width, height - i)), True, height - i, height + m),
        (((i, 0), (i, height)), False, -m, i),
        (((width - i, 0), (width - i, height)), False, width - i, width + m),
    ):
        on_edge = land.intersection(LineString(edge))
        for segment in getattr(on_edge, "geoms", [on_edge]):
            if segment.is_empty or segment.length == 0:
                continue
            a, b = segment.bounds[0:2], segment.bounds[2:4]
            if along_x:
                pieces.append(Polygon([(a[0], low), (b[0], low), (b[0], high), (a[0], high)]))
            else:
                pieces.append(Polygon([(low, a[1]), (high, a[1]), (high, b[1]), (low, b[1])]))
    # The corners, beyond two edges, take the corner's own land or sea.
    for cx, cy in ((0, 0), (width, 0), (0, height), (width, height)):
        if land.distance(Point(cx, cy)) < EDGE_INSET * 2:
            x = -m if cx == 0 else width
            y = -m if cy == 0 else height
            pieces.append(box_polygon({"x": x, "y": y, "width": m, "height": m}))
    return unary_union([piece.buffer(0.5) for piece in pieces]).buffer(-0.5)


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

def place_names(kind: str = "locations") -> dict[str, str]:
    """Names from the content, which decide how much room each label needs."""
    content = json.loads(CONTENT_PATH.read_text())
    return {item["slug"]: item["name"] for item in content[kind]}


def label_width(name: str, scale: float) -> float:
    return (len(name) * LABEL_FONT_SIZE * 0.68 + 26) * scale


# Where a place's name and building may sit over its marker, as a share of
# their width to one side, in order of preference: straight above first.
CARD_SHIFTS = (0, -0.25, 0.25, -0.5, 0.5)
# How far a place the export put down by eye (not a town set to its real
# spot) may move to fit, in its marker's radius, all around.
NUDGES = tuple(
    (distance * cos(angle * pi / 4), distance * sin(angle * pi / 4))
    for distance in (0.75, 1.5, 2.25, 3)
    for angle in range(8)
)
# How far a name pill comes down over the top of its marker.
NAME_OVER_MARKER = 3


def layout_places(
    arts: dict[str, dict[str, float]],
    dots: dict[str, tuple[float, float]],
    names: dict[str, str],
    radius: float,
    scale: float,
    blockers,
    movable: set[str],
) -> dict[str, dict]:
    """One region's places, zoomed in: each place's marker on the very spot of
    its town, and over it its name pill, with its building behind the name.

    Sizes are in the map's units at the region's zoom: `scale` times the size
    the whole map would draw them. The name and building (the card) go
    straight above the marker, or a little to one side, to clear every other
    place's name and marker and to keep the building off `blockers` (the other
    regions and countries; the sea is fine). A `movable` place, which the
    export put down by eye, may also move a little, marker and all. Each place
    is placed twice: the second time around all the others' first places.
    """
    # The towns set to their real spots first, then the rest around them.
    order = sorted(arts, key=lambda location: (location in movable, location))
    placed: dict[str, dict] = {}
    for _ in range(2):
        for location in order:
            others = [entry for other, entry in placed.items() if other != location]
            # Before a place is first placed, its marker is still on its dot.
            waiting = [
                circle_box({"cx": x, "cy": y, "r": radius})
                for other, (x, y) in dots.items()
                if other != location and other not in placed
            ]
            placed[location] = best_place(
                art=arts[location],
                dot=dots[location],
                name=names.get(location, location),
                drawn=location not in HIDDEN_ART,
                nudges=((0.0, 0.0), *NUDGES) if location in movable else ((0.0, 0.0),),
                solid=[
                    *(label_box_of(entry["label"]) for entry in others),
                    *(circle_box(entry["marker"]) for entry in others),
                    *waiting,
                ],
                buildings=[entry["art"] for entry in others if entry["drawn"]],
                radius=radius,
                scale=scale,
                blockers=blockers,
            )
    for entry in placed.values():
        entry.pop("drawn")
    return placed


def best_place(
    *,
    art: dict[str, float],
    dot: tuple[float, float],
    name: str,
    drawn: bool,
    nudges: tuple[tuple[float, float], ...],
    solid: list[dict[str, float]],
    buildings: list[dict[str, float]],
    radius: float,
    scale: float,
    blockers,
) -> dict:
    """The place's best marker, name and building: clear of `solid` (other
    places' names and markers), its name and marker clear of `buildings`, its
    building off `blockers`, and as near straight above its dot as can be."""
    label_height = LABEL_HEIGHT * scale
    label_width_ = label_width(name, scale)
    width = max(art["width"], label_width_)
    best = None
    for nx, ny in nudges:
        marker = {"cx": r2(dot[0] + nx * radius), "cy": r2(dot[1] + ny * radius), "r": r2(radius)}
        marker_box = circle_box(marker)
        label_cy = marker["cy"] - radius - label_height / 2 + NAME_OVER_MARKER * scale
        for shift in CARD_SHIFTS:
            cx = marker["cx"] + shift * width
            label = {
                "cx": r2(cx),
                "cy": r2(label_cy),
                "width": r2(label_width_),
                "height": r2(label_height),
                "fontSize": r2(LABEL_FONT_SIZE * scale),
            }
            label_box = label_box_of(label)
            building = {
                "x": r2(cx - art["width"] / 2),
                "y": r2(label_cy - art["height"]),
                "width": art["width"],
                "height": art["height"],
            }
            card = union([building, label_box]) if drawn else label_box
            # Its name and marker on anything of another place, or its
            # building on another's name or marker.
            covered = sum(
                overlap(mine, other)
                for mine in (label_box, marker_box)
                for other in [*solid, *buildings]
            ) + sum(overlap(card, other) for other in solid)
            touching = sum(overlap(building, other) for other in buildings) if drawn else 0
            off_region = 0.0
            if drawn:
                shape = box_polygon(building)
                off_region = shape.intersection(blockers).area / max(shape.area, 0.01)
            cost = (
                covered * 100
                + touching * 2
                + off_region * 300
                + abs(shift) * 30
                + (nx * nx + ny * ny) ** 0.5 * 12
            )
            if best is None or cost < best[0]:
                best = (
                    cost,
                    {
                        "art": building if drawn else label_box,
                        "marker": marker,
                        "label": label,
                        # The building and its name together, which no other
                        # place covers.
                        "card": card,
                        "drawn": drawn,
                    },
                )
    return best[1]


def label_box_of(label: dict[str, float]) -> dict[str, float]:
    return {
        "x": label["cx"] - label["width"] / 2,
        "y": label["cy"] - label["height"] / 2,
        "width": label["width"],
        "height": label["height"],
    }


def circle_box(marker: dict[str, float]) -> dict[str, float]:
    r = marker["r"]
    return {"x": marker["cx"] - r, "y": marker["cy"] - r, "width": 2 * r, "height": 2 * r}


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


def new_svg(box: tuple[float, float, float, float] = VIEW_BOX) -> ET.Element:
    x, y, w, h = box
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
