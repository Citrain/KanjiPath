import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { ShadowingController } from './shadowing.controller';
import { ShadowingService } from './shadowing.service';

@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [ShadowingController],
  providers: [ShadowingService],
})
export class ShadowingModule {}
