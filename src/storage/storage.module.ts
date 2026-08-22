import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { StorageController } from './storage.controller';

@Module({
  imports: [WorkspaceModule],
  controllers: [StorageController],
  providers: [
    {
      provide: 'B2_CLIENT',
      useFactory: (config: ConfigService) => {
        return new S3Client({
          region: config.get<string>('B2_Region'),
          endpoint: config.get<string>('B2_Endpoint'),
          credentials: {
            accessKeyId: config.getOrThrow<string>('B2_Key_ID'),
            secretAccessKey: config.getOrThrow<string>('B2_ApplicationKey'),
          },
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
