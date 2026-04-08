import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const SELECT_SAFE = {
  id: true, email: true, fullName: true, role: true,
  isActive: true, locale: true, createdAt: true, updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { ...dto, password: hashed },
      select: SELECT_SAFE,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: SELECT_SAFE, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELECT_SAFE });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }
    return this.prisma.user.update({ where: { id }, data, select: SELECT_SAFE });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id }, select: SELECT_SAFE });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    // Fetch with password for verification
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // If changing password, verify current password first
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Current password is required to set a new password');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) throw new UnauthorizedException('Current password is incorrect');
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== user.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email already in use');
    }

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data['fullName'] = dto.fullName;
    if (dto.email !== undefined) data['email'] = dto.email;
    if (dto.locale !== undefined) data['locale'] = dto.locale;
    if (dto.newPassword) data['password'] = await bcrypt.hash(dto.newPassword, 12);

    return this.prisma.user.update({ where: { id }, data, select: SELECT_SAFE });
  }
}
