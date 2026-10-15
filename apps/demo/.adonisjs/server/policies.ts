export const policies = {
  CategoryPolicy: () => import('#policies/category_policy'),
  CouponPolicy: () => import('#policies/coupon_policy'),
  OrderPolicy: () => import('#policies/order_policy'),
  ProductPolicy: () => import('#policies/product_policy'),
  TagPolicy: () => import('#policies/tag_policy'),
}

