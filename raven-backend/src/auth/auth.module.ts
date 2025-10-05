import { Module } from '@nestjs/common';
import {AuthController} from "./auth.controller";
import {LoginService} from "./login.service";
import {RegistrationService} from "./registration.service";

@Module({
    controllers: [AuthController],
    providers: [LoginService, RegistrationService]
})
export class AuthModule {}