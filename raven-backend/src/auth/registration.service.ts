import { Injectable } from '@nestjs/common';

@Injectable()
export class RegistrationService {
    register(body: Body): string {
        return JSON.stringify({
            message: 'User registered successfully',
            deviceId: "12345",
            user: body
        });
    }
}
