export interface IReview {
  id: number,
  product_id: number,
  user_id: number,
  rating: number,
  comment: string,
  created_at: Date
}