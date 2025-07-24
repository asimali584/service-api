import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class CompanyPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  websiteLink: string;

  @Column('double precision')
  latitude: number;

  @Column('double precision')
  longitude: number;

  @Column('double precision')
  distanceRange: number;

  @Column('simple-array', { nullable: true })
  workingDays: string[]; // Array of working days like ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  @Column({ nullable: true })
  startTime: string; // Time format like "9:00 AM"

  @Column({ nullable: true })
  endTime: string; // Time format like "5:00 PM"

  @OneToOne(() => User, (user) => user.companyPreference, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;
}
