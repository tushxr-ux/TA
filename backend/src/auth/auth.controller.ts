import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsString() inviteCode: string;
  @IsString() @MinLength(3) username: string;
  @IsString() @MinLength(1) displayName: string;
  @IsString() @MinLength(8) password: string;
}

class LoginDto {
  @IsString() username: string;
  @IsString() password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
