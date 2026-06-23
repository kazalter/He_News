import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // nest start:dev 重启子进程时，Windows 上不会自动 release listener，
  // 容易导致新进程 EADDRINUSE 而崩掉、旧的继续提供过期代码。
  // 显式处理 SIGINT / SIGTERM，让 app.close() 在端口释放后再退出。
  app.enableShutdownHooks();
  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, closing app...`);
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
