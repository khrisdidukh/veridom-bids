import { Outlet } from "react-router";

export function meta() {
  return [{ title: "Veridom Bids — compare renovation quotes" }];
}

export default function BidsLayout() {
  return <Outlet />;
}
