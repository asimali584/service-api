import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('company_details')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessName: string;

  @Column()
  businessType: string;

  @Column()
  businessDescription: string;

  @Column({ type: 'text', nullable: false })
  imageUrl: string;

  @OneToOne(() => User, (user) => user.company, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;
}
