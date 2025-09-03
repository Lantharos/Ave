import {Controller, Get} from '@nestjs/common';
import {UsersService} from "./users.service";

@Controller('users')
export class UsersController {
    constructor(private readonly appService: UsersService) {}

    @Get("/create")
    getHello(): string {
        return this.appService.getHello();
    }
}
