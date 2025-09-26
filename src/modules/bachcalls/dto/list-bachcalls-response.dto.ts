import { BatchCallDto } from './batch-call.dto';

export class ListBachcallsResponseDto {
  batch_calls: BatchCallDto[];
  next_doc: string;
  has_more: boolean;
}
