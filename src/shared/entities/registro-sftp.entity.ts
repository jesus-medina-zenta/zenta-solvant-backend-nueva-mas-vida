export type MetadataUser = Record<string, any>;

export class RegistroSftp {
  id?: string;
  fecha: string;
  phone_number: string;
  phone_number_2: string;
  metadata_user: MetadataUser;
}
