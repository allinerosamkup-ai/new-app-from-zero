import type {
  CheckinCreateInput,
  CheckinCreateResult,
  RecentCheckinsResult,
} from '../entities/checkin';

export interface CheckinRepository {
  createCheckin(data: CheckinCreateInput): Promise<CheckinCreateResult>;
  getRecentCheckins(days?: number): Promise<RecentCheckinsResult>;
}
