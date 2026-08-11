export type ProductCapabilities = Readonly<{
  planner: boolean;
  habits: boolean;
  connectedCalendar: boolean;
}>;

export const PRODUCT_CAPABILITIES: ProductCapabilities = Object.freeze({
  planner: false,
  habits: false,
  connectedCalendar: false,
});
