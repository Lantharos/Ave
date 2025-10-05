import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // CORS for dev (Vite at 5173). Add/remove origins as needed.
    app.enableCors({
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true, // only if you use cookies/sessions
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    const port = Number(process.env.PORT ?? 7551);
    await app.listen(port, '0.0.0.0'); // host helps if Docker/WSL
    console.log(`API on http://localhost:${port}`);
}
bootstrap();
