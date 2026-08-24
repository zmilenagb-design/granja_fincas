import { 
  ReproductiveEvent, 
  CreateReproductiveEventInput, 
  ReproductiveEventWithRelations 
} from '@/types/domain/reproduction.schema';

export interface IReproductionRepository {
  getEventsByAnimal(animalId: string): Promise<ReproductiveEvent[]>;
  getAllEventsWithRelations(): Promise<ReproductiveEventWithRelations[]>;
  getReproductionSummary(): Promise<{ successfulBirths: number; activeGestations: number; failures: number }>;
  registerEvent(input: CreateReproductiveEventInput): Promise<ReproductiveEvent>;
  updateEvent(id: string, input: Partial<ReproductiveEvent>): Promise<ReproductiveEvent>;
  listAnimalsBySex(sex: 'hembra' | 'macho'): Promise<any[]>;
}
