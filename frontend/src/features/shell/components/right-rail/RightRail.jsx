import SideGaugeCard from "./SideGaugeCard";

export default function RightRail({ shellProps, gaugeProps }) {
  return (
    <aside className="right-rail">
      <SideGaugeCard shellProps={shellProps} {...gaugeProps} />
    </aside>
  );
}
