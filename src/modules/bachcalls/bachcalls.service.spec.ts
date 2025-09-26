import { Test, TestingModule } from '@nestjs/testing';
import { BachcallsService } from './bachcalls.service';

describe('BachcallsService', () => {
  let service: BachcallsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BachcallsService],
    }).compile();

    service = module.get<BachcallsService>(BachcallsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
