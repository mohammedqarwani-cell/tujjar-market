import { Module } from '@nestjs/common';
// import { PrismaService } from '../prisma.service';

// Submodules
import { AuthModule } from './auth/auth.module';
import { RegionsModule } from 'src/regions/regions.module';
// لو عندك UsersModule أضِفه: import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    // UsersModule,
    RegionsModule, // 👈 هنا
  ],
  //   providers: [PrismaService],
  exports: [AuthModule, RegionsModule], // لتستخدم الـJwtAuthGuard خارجًا
})
export class IdentityModule {}
