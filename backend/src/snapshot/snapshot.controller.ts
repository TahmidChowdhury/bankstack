import { Controller, Get } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';

@Controller('snapshots')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Get()
  async getSnapshots() {
    return this.snapshotService.getSnapshots();
  }
}
