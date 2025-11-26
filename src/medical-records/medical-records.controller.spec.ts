import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordsController } from './medical-records.controller';

describe('MedicalRecordsController', () => {
  let controller: MedicalRecordsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordsController],
    }).compile();

    controller = module.get<MedicalRecordsController>(MedicalRecordsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
