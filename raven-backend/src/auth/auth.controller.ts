import {Body, Controller, Post} from '@nestjs/common';
import {LoginService} from "./login.service";
import {RegistrationService} from "./registration.service";

@Controller('auth')
export class AuthController {
    constructor(private readonly loginService: LoginService, private readonly registrationService: RegistrationService) {}

    @Post("/register")
    register(@Body() body: Body): string {
        return this.registrationService.register(body);
    }

    @Post("/login")
    login(): string {
        return this.loginService.login();
    }
}
