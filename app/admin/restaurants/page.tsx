import { redirect } from "next/navigation";

import { getRestaurantsDashboardPageData } from "../../../lib/server/restaurantsDashboardPage";
import { RestaurantsDashboard } from "./RestaurantsDashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminRestaurantsPage() {
  const data = await getRestaurantsDashboardPageData();
  if (data.kind === "unauthorized") {
    redirect("/admin/login?next=/admin/restaurants");
  }
  return <RestaurantsDashboard pageData={data} />;
}
