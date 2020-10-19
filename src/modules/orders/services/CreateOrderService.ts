import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exists');
    }

    const stockProducts = await this.productsRepository.findAllById(products);

    const updateStockProducts: IUpdateProductsQuantityDTO[] = [];

    const orderProducts = products.map(orderProduct => {
      const { id, quantity } = orderProduct;
      const stockProduct = stockProducts.find(p => p.id === orderProduct.id);

      if (!stockProduct) {
        throw new AppError('Product not found');
      }

      if (stockProduct.quantity < orderProduct.quantity) {
        throw new AppError('Not enough products in the stock.');
      }

      updateStockProducts.push({
        id: stockProduct.id,
        quantity: stockProduct.quantity - orderProduct.quantity,
      });

      return {
        product_id: id,
        quantity,
        price: stockProduct.price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(updateStockProducts);

    return order;
  }
}

export default CreateOrderService;
