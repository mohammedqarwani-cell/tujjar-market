import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(data: { email: string; passwordHash: string; role?: 'ADMIN'|'MERCHANT'|'USER' }) {
    return this.prisma.user.create({ data: { role: 'MERCHANT', ...data } });
  }
}
