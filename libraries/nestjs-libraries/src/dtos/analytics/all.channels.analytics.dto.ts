import {
  IsDefined,
  IsString,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'AllChannelsDateRange', async: false })
export class AllChannelsDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as AllChannelsAnalyticsDto;
    if (!obj?.from || !obj?.to) {
      return false;
    }
    if (!DATE_PATTERN.test(obj.from) || !DATE_PATTERN.test(obj.to)) {
      return false;
    }

    const from = dayjs.utc(obj.from, 'YYYY-MM-DD', true).startOf('day');
    const to = dayjs.utc(obj.to, 'YYYY-MM-DD', true).startOf('day');
    if (!from.isValid() || !to.isValid()) {
      return false;
    }
    if (to.isBefore(from)) {
      return false;
    }

    const inclusiveDays = to.diff(from, 'day') + 1;
    return inclusiveDays >= 1 && inclusiveDays <= 100;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as AllChannelsAnalyticsDto;
    if (!obj?.from || !obj?.to) {
      return 'from and to are required (YYYY-MM-DD)';
    }
    if (!DATE_PATTERN.test(obj.from) || !DATE_PATTERN.test(obj.to)) {
      return 'from and to must be YYYY-MM-DD';
    }

    const from = dayjs.utc(obj.from, 'YYYY-MM-DD', true).startOf('day');
    const to = dayjs.utc(obj.to, 'YYYY-MM-DD', true).startOf('day');
    if (!from.isValid() || !to.isValid()) {
      return 'from and to must be valid dates';
    }
    if (to.isBefore(from)) {
      return 'to must be on or after from';
    }

    const inclusiveDays = to.diff(from, 'day') + 1;
    if (inclusiveDays > 100) {
      return 'date range must be at most 100 days (inclusive)';
    }

    return 'invalid date range';
  }
}

export class AllChannelsAnalyticsDto {
  @IsDefined()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @Validate(AllChannelsDateRangeConstraint)
  from: string;

  @IsDefined()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @Validate(AllChannelsDateRangeConstraint)
  to: string;
}
