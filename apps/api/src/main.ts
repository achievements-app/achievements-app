import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app/app.module";
import { DbService } from "./app/shared/db/db.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix);

  const dbService = app.get(DbService);
  await dbService.enableShutdownHooks(app);

  const port = process.env.PORT || 3333;
  await app.listen(port, "0.0.0.0");

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
