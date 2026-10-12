export const policies = {
  CategoryPolicy: () => import('#policies/category_policy'),
  OrderPolicy: () => import('#policies/order_policy'),
  ProductPolicy: () => import('#policies/product_policy'),
}

