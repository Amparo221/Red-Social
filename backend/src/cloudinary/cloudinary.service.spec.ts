import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        {
          // ConfigService falso: el servicio solo necesita leer 3 claves.
          provide: ConfigService,
          useValue: {
            get: jest.fn((clave: string) => {
              const valores: Record<string, string> = {
                CLOUD_NAME: 'demo',
                API_KEY: '123456789',
                API_SECRET: 'secreto-de-prueba',
              };
              return valores[clave];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  it('debería instanciarse con la configuración cargada', () => {
    expect(service).toBeDefined();
  });
});
