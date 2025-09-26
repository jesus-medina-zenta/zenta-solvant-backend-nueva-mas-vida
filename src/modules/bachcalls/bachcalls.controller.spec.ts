import { Test, TestingModule } from '@nestjs/testing';
import { BachcallsController } from './bachcalls.controller';
import { BachcallsService } from './bachcalls.service';

describe('BachcallsController', () => {
  let controller: BachcallsController;
  let service: BachcallsService;

  const mockBachcallsService = {
    findAll: jest.fn(() => []),
    findOne: jest.fn((id: string) => null),
    create: jest.fn((dto: any) => dto),
    update: jest.fn((id: string, dto: any) => ({ id, ...dto })),
    remove: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BachcallsController],
      providers: [
        {
          provide: BachcallsService,
          useValue: mockBachcallsService,
        },
      ],
    }).compile();

    controller = module.get<BachcallsController>(BachcallsController);
    service = module.get<BachcallsService>(BachcallsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
