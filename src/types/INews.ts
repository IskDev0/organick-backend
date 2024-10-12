export interface INews{
  id: number
  title: string
  content: string
  user_id: number
  preview: string
  short_description: string
  created_at: Date
  updated_at: Date
}

export interface INewsWithUser extends INews{
  first_name: string,
  last_name: string
}