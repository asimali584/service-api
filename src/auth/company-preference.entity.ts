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

  @Column({ nullable: true })
  startDay: string;

  @Column({ nullable: true })
  endDay: string;

  @Column({ nullable: true, type: 'date' })
  startDate: Date;

  @Column({ nullable: true, type: 'date' })
  endDate: Date;

  @OneToOne(() => User, (user) => user.companyPreference, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;
}
