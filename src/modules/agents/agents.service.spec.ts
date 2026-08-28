import { Test, TestingModule } from '@nestjs/testing';
import { AgentsService } from './agents.service';

describe('AgentsService', () => {
  let service: AgentsService;

  const mockExternalApiService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: 'EXTERNAL_API_SERVICE', useValue: mockExternalApiService },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
