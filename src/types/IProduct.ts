export interface IProduct {
    id: number,
    name: string,
    description: string,
    price: number,
    rating: number,
    image_url: string,
    category_id: number,
    stock: number,
    is_active: boolean,
    discount: number,
    created_at: Date,
    updated_at: Date
}

export interface IProductWithCategory extends IProduct {
    category: string
}