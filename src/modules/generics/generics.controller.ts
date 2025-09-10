import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { CsrfInterceptor } from 'src/shared/interceptors/csrf.interceptor';
import { GenericsService } from './generics.service';
import { CreateGenericDto } from './dtos/create-generic.dto';
import { Generic } from 'src/shared/entities/generic.entity';
import { UpdateGenericDto } from './dtos/update-generic.dto';

@ApiTags('Generics')
@Controller('generics')
@UseInterceptors(CsrfInterceptor)
export class GenericsController {
  constructor(private readonly service: GenericsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo registro' })
  @ApiBody({ type: CreateGenericDto })
  @ApiResponse({
    status: 201,
    description: 'Registro creado exitosamente',
    type: Generic,
  })
  @ApiResponse({ status: 400, description: 'Error de validación en DTO' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado (role no permitido)',
  })
  async create(@Body() createGenericDto: CreateGenericDto): Promise<Generic> {
    return this.service.create(createGenericDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los registros' })
  @ApiResponse({
    status: 200,
    description: 'Retorna un array de registros',
    type: [Generic],
  })
  async findAll(): Promise<Generic[]> {
    return this.service.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un registro por ID' })
  @ApiParam({ name: 'id', description: 'ID del registro' })
  @ApiResponse({
    status: 200,
    description: 'Retorna el registro solicitado',
    type: Generic,
  })
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  async findOne(@Param('id') id: string): Promise<Generic | null> {
    return this.service.getById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un registro' })
  @ApiParam({ name: 'id', description: 'ID del registro' })
  @ApiResponse({
    status: 200,
    description: 'Registro actualizado exitosamente',
    type: Generic,
  })
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() updateGenericDto: UpdateGenericDto,
  ): Promise<Generic> {
    return this.service.update(id, updateGenericDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un registro' })
  @ApiParam({ name: 'id', description: 'ID del registro' })
  @ApiResponse({ status: 200, description: 'Registro eliminado correctamente' })
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
