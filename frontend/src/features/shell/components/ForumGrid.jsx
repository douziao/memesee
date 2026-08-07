import Feed from "../../feed/components/Feed";
import LeftRail from "./left-rail/LeftRail";
import RightRail from "./right-rail/RightRail";

export default function ForumGrid({
  leftRailProps,
  feedProps,
  rightRailProps,
}) {
  return (
    <div className="forum-grid">
      <LeftRail {...leftRailProps} />
      <Feed {...feedProps} />
      <RightRail {...rightRailProps} />
    </div>
  );
}
