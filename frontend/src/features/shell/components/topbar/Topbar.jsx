import Brand from "./Brand";
import TopbarIsland from "./TopbarIsland";
import TopNavActions from "./TopNavActions";

export default function Topbar({
  shellProps,
  islandProps,
  navProps,
}) {
  const { route, view, topbarRef } = shellProps;

  return (
    <header className="neo-topbar" ref={topbarRef}>
      <Brand />
      {(route.type === "post" ||
        route.type === "compose" ||
        route.type === "home") && (
        <TopbarIsland shellProps={{ route, view }} {...islandProps} />
      )}
      <TopNavActions view={view} {...navProps} />
    </header>
  );
}

