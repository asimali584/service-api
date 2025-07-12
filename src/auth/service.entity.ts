import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ServiceLocation {
  IN_CALL = 'in-call',
  OUT_CALL = 'out-call',
  BOTH = 'both',
}

export enum RateType {
  FIXED_PRICE = 'Fixed Price', // Changed from 'Fixed price'
  BY_HOUR = 'By hour', // Keep as is, but ensure client matches
  BY_ROOM = 'By Room', // Matches client
  BY_WINDOW = 'By Window', // Changed from 'By window'
}

@Entity()
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  imageUrl: string;

  @Column()
  serviceName: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: ServiceLocation,
  })
  location: ServiceLocation;

  @Column({
    type: 'enum',
    enum: RateType,
  })
  rateType: RateType;

  @Column('decimal')
  price: number;

  @Column({ nullable: true })
  timeDuration: number;

  @ManyToOne(() => User, (user) => user.service, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;
}
