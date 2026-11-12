import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConsultarEstadisticasDto } from './dto/consultar-estadisticas.dto';
import { EstadisticasService } from './estadisticas.service';

/**
 * Dashboard de estadísticas (Sprint 5).
 *
 * Igual que `/usuarios`, los dos guards van a nivel de controller: el de sesión
 * resuelve quién es el usuario y `RolesGuard` corta con 403 a todo el que no sea
 * administrador. Los números salen de TODOS los usuarios, así que no es
 * información para un usuario común.
 */
@Controller('estadisticas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  /**
   * GET /estadisticas?desde=2026-10-12&hasta=2026-11-11&agrupacion=dia&limite=10
   *
   * Devuelve las tres métricas del dashboard en una sola respuesta para que el
   * front no tenga que encadenar pedidos ni mostrar los gráficos desfasados.
   */
  @Get()
  async consultar(@Query() dto: ConsultarEstadisticasDto) {
    return this.estadisticasService.obtener(dto);
  }
}
