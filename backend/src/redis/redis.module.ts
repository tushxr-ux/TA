import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => {
        const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
        client.on('error', (err) => console.warn('Redis notice:', err.message));
        return client;
      },
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
