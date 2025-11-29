import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecord } from './entities/medical-record.entity';

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let repository: Repository<MedicalRecord>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MedicalRecordsService>(MedicalRecordsService);
    repository = module.get<Repository<MedicalRecord>>(
      getRepositoryToken(MedicalRecord),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
