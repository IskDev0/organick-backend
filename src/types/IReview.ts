export interface IReview {
  id: number,
  product_id: number,
  user_id: number,
  rating: number,
  comment: string,
  created_at: Date
}

export interface IProfileReview extends IReview {
  first_name: string
  last_name: string
  product_id: number
  product_name: string
  product_image: string
  price: string
  old_price: string
}