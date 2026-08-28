import { Test, TestingModule } from '@nestjs/testing';
import { BachcallsService } from './bachcalls.service';
import { GcpPipelineService } from 'src/shared/services/gcp-pipeline.service';
import { ExcelCsvProcessor } from 'src/shared/services/excel-csv-processor.service';

describe('BachcallsService', () => {
  let service: BachcallsService;

  const mockExternalApiService = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const mockCsvStorageService = {
    uploadFile: jest.fn(),
    getFile: jest.fn(),
  };
  const mockRegistroArchivosRepository = {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const mockRegistrosSftpRepository = {
    getById: jest.fn(),
    query: jest.fn(),
  };
  const mockGcpPipelineService = {
    triggerPipeline: jest.fn(),
  };
  const mockExcelCsvProcessor = {
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BachcallsService,
        { provide: 'EXTERNAL_API_SERVICE', useValue: mockExternalApiService },
        { provide: 'CSV_STORAGE_SERVICE', useValue: mockCsvStorageService },
        {
          provide: 'REGISTRO_ARCHIVOS_REPOSITORY',
          useValue: mockRegistroArchivosRepository,
        },
        {
          provide: 'REGISTROS_SFTP_REPOSITORY',
          useValue: mockRegistrosSftpRepository,
        },
        { provide: GcpPipelineService, useValue: mockGcpPipelineService },
        { provide: ExcelCsvProcessor, useValue: mockExcelCsvProcessor },
      ],
    }).compile();

    service = module.get<BachcallsService>(BachcallsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
