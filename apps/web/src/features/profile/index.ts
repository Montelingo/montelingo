// The profile feature's public API: the child's profile, how the map shows
// them, and the setup choices. Side-effect free, so any feature may import it.
export {
  AGE_BANDS,
  type AgeBand,
  type Avatar,
  AVATARS,
  avatarSrc,
  type Explorer,
  type Profile,
  toExplorer,
} from "./model/profile";
