import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CsrfInterceptor } from 'src/shared/interceptors/csrf.interceptor';
import { CsrfService } from 'src/shared/services/csrf.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    createUser: jest.fn(),
    getUserById: jest.fn(),
  };
  const mockCsrfTokenRepository = {
    createOrReplace: jest.fn(),
    getById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        CsrfInterceptor,
        CsrfService,
        {
          provide: 'CSRF_TOKEN_REPOSITORY',
          useValue: mockCsrfTokenRepository,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
