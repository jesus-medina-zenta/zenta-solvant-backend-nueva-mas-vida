import { Controller, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { BachcallsService } from './bachcalls.service';
import { SecurityValidationPipe } from 'src/shared/pipes/validations/security-validation.pipe';
import { ListBachcallsResponseDto } from './dto/list-bachcalls-response.dto';
import { DetailedBatchCallDto } from './dto/detailed-batch-call.dto';

@Controller('bachcalls')
export class BachcallsController {
  constructor(private readonly bachcallsService: BachcallsService) {}

  @Get()
  @ApiOperation({ summary: 'List all batch calls' })
  @ApiResponse({
    status: 200,
    description: 'List of batch calls retrieved successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of batch calls to return.',
  })
  @ApiQuery({
    name: 'last_doc',
    required: false,
    type: String,
    description: 'Last document ID for pagination.',
  })
  @UsePipes(new SecurityValidationPipe())
  async listBachcalls(
    @Query('limit') limit: number = 30,
    @Query('last_doc') last_doc?: string,
  ): Promise<ListBachcallsResponseDto> {
    return this.bachcallsService.listBachcalls(limit, last_doc);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed batch call by ID' })
  @ApiResponse({
    status: 200,
    description: 'Batch call details retrieved successfully.',
    type: DetailedBatchCallDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Batch call not found.' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the batch call.',
    example: 'btcal_6801k59m1t31e8xt43nscbtxfakf',
  })
  @UsePipes(new SecurityValidationPipe())
  async getBachcallById(
    @Param('id') id: string,
  ): Promise<DetailedBatchCallDto> {
    return this.bachcallsService.getBachcallById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a batch call by ID' })
  @ApiResponse({
    status: 204,
    description: 'Batch call canceled successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Batch call not found.' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the batch call to cancel.',
    example: 'btcal_6801k59m1t31e8xt43nscbtxfakf',
  })
  @UsePipes(new SecurityValidationPipe())
  async cancelBachcall(@Param('id') id: string): Promise<void> {
    return this.bachcallsService.cancelBachcall(id);
  }
}
