import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [UsuariosModule, CloudinaryModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}