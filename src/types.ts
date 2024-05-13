// https://www.typescriptlang.org/docs/handbook/declaration-files/by-example.html

/** 数据类型 */
export type DataType = "INTEGER" | "LONG" | "FLOAT" | "VARCHAR" | "TEXT";

export type MyObject<T = any> = { [k in string]: T };

export type SqliteOrmRsultType = [string, any[]];

/** 表字段配置 */
export type TableFieldsOption = {
  /** 字段名 */
  field: string;
  /** 数据类型 */
  type: DataType;
  /** 是否是主键 */
  isKey?: boolean;
  /** 不能为空 */
  isNotNull?: boolean;
};

export type CurOperType = keyof Pick<CurOrmStoreType, "delete" | "update" | "select" | "count">;

/** ORM 保存的状态 */
export type CurOrmStoreType = {
  /** INSERT 相关操作 */
  insert?: string;
  /** 批量 INSERT 相关操作 */
  inserts?: string[];
  /** DELETE 相关操作 */
  delete?: boolean;
  /** UPDATE 相关操作 */
  update?: MyObject;
  /** SELECT 相关操作 */
  select?: string;
  /** COUNT 相关操作 */
  count?: string;
  /** 当前的操作类型 */
  curOper?: CurOperType;
  // /** 是否值填充模式 */
  // isFillValue: boolean;
  /** 填充的值 */
  fillValue: any[];
  /** 保存 GROUP BY */
  groupBy?: string;
  /** 保存 ORDER BY */
  orderBy?: [OrderByType, string];
  /** WHERE 条件汇总 */
  // where?: string[];
  where?: WhereItem[];
  /** 是否有调用 where() */
  isSetWhere?: boolean;
  /** limit 条件 */
  limit?: [number, number] | [number];
};

/** WHERE 类型 */
export type WhereType = "AND" | "OR";
/** WHERE 特殊连接符 */
export type WhereConnectSpecialType = "IS NOT" | "IN" | "NOT" | "like";
/** WHERE 连接符 */
export type WhereConnectType = "=" | ">" | ">=" | "<" | "<=" | "!=" | WhereConnectSpecialType;
/** ORDER 类型 */
export type OrderByType = "ASC" | "DESC";

/** Where 项 */
export type WhereItem = {
  /**
   * 分类
   * - WHERE 表示 and 和 or 操作
   * - CONNECT 表示连接符一般是 OR, AND, (, )
   *
   */
  type: "WHERE" | "CONNECT";
  /** 键 */
  key: string;
  /** 连接符 */
  connect: WhereConnectType | "";
  /** 值 */
  value: string | number | (() => string | number);
};

/** 构建 update when 配置 */
export type BuildUpdateByWhenOption<T = any> = {
  /** 操作的数据 */
  datas: T[];

  /** 一次最大更新多少条数据 */
  onceMaxUpdateDataLength?: number;

  /** 字段数据 */
  fieldOpts: {
    /** SET xxx 里的 xxx 字段 */
    setField: string;

    /** WHEN xxx=yyy 里的 xxx 数据 */
    getWhenField: (row: T) => string | number;

    /** WHEN xxx=yyy 里的 yyy 数据 */
    getWhenValue: (row: T) => string | number;

    /** THEN xxx=yyy 里的 yyy 数据 */
    getThenValue: (row: T) => string | number;
  }[];

  /** 额外的 updateWhen 子句 */
  getExtraUpdateWhen?: (updates: T[]) => string;

  /** 额外的 where 子句 */
  getExtraWhere?: (updates: T[]) => string;
};
