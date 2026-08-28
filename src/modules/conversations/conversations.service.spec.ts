import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  let service: ConversationsService;

  const mockExternalApiService = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const mockAudioStorageService = {
    getAudioUrl: jest.fn(),
    uploadAudio: jest.fn(),
  };
  const mockAudiosStatusRepository = {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: 'EXTERNAL_API_SERVICE', useValue: mockExternalApiService },
        {
          provide: 'AUDIO_STORAGE_REPOSITORY',
          useValue: mockAudioStorageService,
        },
        {
          provide: 'AUDIOS_STATUS_REPOSITORY',
          useValue: mockAudiosStatusRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
